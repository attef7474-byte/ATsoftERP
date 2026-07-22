import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { buildDateFilter, paginate } from './report-query-utils';

@Injectable()
export class AuditReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAuditTrailReport(filters: any) {
    const where: any = { ...buildDateFilter(filters.dateFrom, filters.dateTo) };
    if (filters.entity) where.entity = filters.entity;
    if (filters.action) where.action = filters.action;
    if (filters.userId) where.userId = filters.userId;
    if (filters.search) where.details = { contains: filters.search };

    const [total, rows, byAction, byEntity, byUser] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where, ...paginate(filters.page, filters.pageSize),
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, name: true } } },
      }),
      this.prisma.auditLog.groupBy({ by: ['action'], where, _count: true }),
      this.prisma.auditLog.groupBy({ by: ['entity'], where, _count: true }),
      this.prisma.auditLog.groupBy({ by: ['userId'], where, _count: true, orderBy: { _count: { id: 'desc' } }, take: 10 }),
    ]);

    const totalPages = Math.ceil(total / (filters.pageSize || 20));
    return {
      cards: [
        { label: 'totalAuditEntries', value: total },
        { label: 'uniqueActions', value: byAction.length },
        { label: 'uniqueEntities', value: byEntity.length },
      ],
      rows, total, page: filters.page || 1, pageSize: filters.pageSize || 20, totalPages,
      byAction: byAction.map(a => ({ action: a.action, count: a._count })),
      byEntity: byEntity.map(e => ({ entity: e.entity, count: e._count })),
      topUsers: byUser.map(u => ({ userId: u.userId, count: u._count })),
    };
  }

  async getUserActivityReport(filters: any) {
    const where: any = { ...buildDateFilter(filters.dateFrom, filters.dateTo, 'lastLoginAt') };
    if (filters.search) where.OR = [{ name: { contains: filters.search } }, { email: { contains: filters.search } }];
    if (filters.status) where.status = filters.status;

    const [total, rows, activeCount, inactiveCount] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where, ...paginate(filters.page, filters.pageSize),
        orderBy: { lastLoginAt: 'desc' },
        select: { id: true, name: true, email: true, status: true, lastLoginAt: true, createdAt: true },
      }),
      this.prisma.user.count({ where: { status: 'ACTIVE' } }),
      this.prisma.user.count({ where: { status: 'INACTIVE' } }),
    ]);

    const totalPages = Math.ceil(total / (filters.pageSize || 20));
    return {
      cards: [
        { label: 'totalUsers', value: total },
        { label: 'activeUsers', value: activeCount },
        { label: 'inactiveUsers', value: inactiveCount },
      ],
      rows, total, page: filters.page || 1, pageSize: filters.pageSize || 20, totalPages,
    };
  }

  async getNotificationsReport(filters: any) {
    const where: any = { ...buildDateFilter(filters.dateFrom, filters.dateTo) };
    if (filters.search) where.title = { contains: filters.search };

    const [total, rows, byType, unreadCount] = await Promise.all([
      this.prisma.notification.count({ where }),
      this.prisma.notification.findMany({
        where, ...paginate(filters.page, filters.pageSize),
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.groupBy({ by: ['type'], where, _count: true }),
      this.prisma.notification.count({ where: { read: false } }),
    ]);

    const totalPages = Math.ceil(total / (filters.pageSize || 20));
    return {
      cards: [
        { label: 'totalNotifications', value: total },
        { label: 'unreadNotifications', value: unreadCount },
        { label: 'notificationCategories', value: byType.length },
      ],
      rows, total, page: filters.page || 1, pageSize: filters.pageSize || 20, totalPages,
      byType: byType.map(t => ({ type: t.type, count: t._count })),
    };
  }
}
