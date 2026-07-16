import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(params: {
    userId?: string;
    action: string;
    entity: string;
    entityId?: string;
    details?: string;
    ip?: string;
    userAgent?: string;
  }) {
    return this.prisma.auditLog.create({
      data: {
        userId: params.userId,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        details: params.details,
        ip: params.ip,
        userAgent: params.userAgent,
      },
    });
  }

  async findAll(query: {
    page?: number;
    limit?: number;
    userId?: string;
    entity?: string;
    action?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.userId) where.userId = query.userId;
    if (query.entity) where.entity = query.entity;
    if (query.action) where.action = query.action;
    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = new Date(query.startDate);
      if (query.endDate) where.createdAt.lte = new Date(query.endDate);
    }

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, email: true, name: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data: data.map((log) => ({
        ...log,
        details: this.sanitizeDetails(log.details),
      })),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const log = await this.prisma.auditLog.findUnique({
      where: { id },
      include: { user: { select: { id: true, email: true, name: true } } },
    });
    if (!log) throw new NotFoundException('Audit log not found');
    return { ...log, details: this.sanitizeDetails(log.details) };
  }

  private sanitizeDetails(details: any): any {
    if (!details) return details;
    let obj: any;
    if (typeof details === 'string') {
      try {
        obj = JSON.parse(details);
      } catch {
        return details;
      }
    } else {
      obj = details;
    }
    const sensitiveKeys = ['password', 'secret', 'token', 'jwt', 'authorization', 'credential', 'apiKey', 'apiSecret'];
    const redact = (val: any, key?: string): any => {
      if (key && sensitiveKeys.some((k) => key.toLowerCase().includes(k.toLowerCase()))) return '***';
      if (Array.isArray(val)) return val.map((v) => redact(v));
      if (val && typeof val === 'object') {
        const result: Record<string, any> = {};
        for (const [k, v] of Object.entries(val)) result[k] = redact(v, k);
        return result;
      }
      return val;
    };
    return redact(obj);
  }
}
