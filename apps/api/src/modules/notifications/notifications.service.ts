import { Injectable, Optional } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { DispatchNotificationDto } from './dto/dispatch-notification.dto';

const AUDIT_ENTITY = 'Notification';
const AUDIT_SCOPE = 'USER_NOTIFICATIONS';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService, @Optional() private readonly audit?: AuditService) {}

  private auditWriter(): AuditService {
    return this.audit ?? new AuditService(this.prisma);
  }

  /**
   * Notifications carry no tenant columns. Scope is derived from the
   * authoritative user record, never from a client-provided company/branch.
   */
  private async scopeForUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { companyId: true, branchId: true },
    });
    return {
      companyId: user?.companyId ?? null,
      branchId: user?.branchId ?? null,
    };
  }

  private async auditWrite(
    userId: string | undefined,
    action: string,
    entityId: string | undefined,
    targetUserId: string,
    previous: Record<string, unknown> | null,
    next: Record<string, unknown>,
    reason: string,
  ) {
    if (!userId) return; // never emit actorless audit rows
    const scope = await this.scopeForUser(targetUserId);
    await this.auditWriter().log(userId, action, AUDIT_ENTITY, entityId, {
      schemaVersion: 1,
      companyId: scope.companyId,
      branchId: scope.branchId,
      scope: AUDIT_SCOPE,
      actor: { userId },
      targetUserId,
      previous,
      next,
      reason,
    });
  }

  async dispatch(dto: DispatchNotificationDto, userId?: string) {
    const created = await this.prisma.notification.create({ data: dto });
    await this.auditWrite(userId, 'DISPATCH', created.id, dto.userId, null, {
      id: created.id,
      targetUserId: dto.userId,
      title: created.title,
      type: created.type,
      link: created.link ?? null,
      read: created.read,
    }, 'NOTIFICATION_DISPATCHED');
    return created;
  }

  async findInbox(userId: string, query: { page?: number; limit?: number; type?: string; read?: string }) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = { userId };
    if (query.type) where.type = query.type;
    if (query.read === 'true') where.read = true;
    else if (query.read === 'false') where.read = false;

    const [data, total] = await Promise.all([
      this.prisma.notification.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async markRead(id: string, userId: string, actorUserId?: string) {
    const before = await this.prisma.notification.findFirst({ where: { id, userId } });
    const result = await this.prisma.notification.updateMany({
      where: { id, userId },
      data: { read: true },
    });
    await this.auditWrite(actorUserId, 'MARK_READ', id, userId,
      { read: before?.read ?? null },
      { read: true, affected: result.count },
      'NOTIFICATION_MARK_READ');
    return result;
  }

  async markAllRead(userId: string, actorUserId?: string) {
    const before = await this.prisma.notification.count({ where: { userId, read: false } });
    const result = await this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
    await this.auditWrite(actorUserId, 'MARK_ALL_READ', undefined, userId,
      { unreadCount: before },
      { unreadCount: 0, affected: result.count },
      'NOTIFICATION_MARK_ALL_READ');
    return result;
  }

  async delete(id: string, userId: string, actorUserId?: string) {
    const before = await this.prisma.notification.findFirst({ where: { id, userId } });
    const result = await this.prisma.notification.deleteMany({
      where: { id, userId },
    });
    await this.auditWrite(actorUserId, 'DELETE', id, userId,
      before ? { title: before.title, type: before.type, read: before.read } : null,
      { deleted: true, affected: result.count },
      'NOTIFICATION_DELETED');
    return result;
  }

  async countUnread(userId: string) {
    return this.prisma.notification.count({
      where: { userId, read: false },
    });
  }
}
