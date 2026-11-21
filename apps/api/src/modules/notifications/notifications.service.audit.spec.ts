import { NotificationsService } from './notifications.service';
import { PrismaService } from '../../common/prisma/prisma.service';

describe('NotificationsService audit emission (Phase 6)', () => {
  let prisma: any;
  let audit: any;
  let service: NotificationsService;

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ companyId: 'company-a', branchId: 'branch-a' }),
      },
      notification: {
        create: jest.fn().mockResolvedValue({
          id: 'notification-1',
          userId: 'target-user',
          title: 'Maintenance due',
          type: 'MAINTENANCE',
          link: '/maintenance/orders/1',
          read: false,
        }),
        findFirst: jest.fn().mockResolvedValue({ title: 'Maintenance due', type: 'MAINTENANCE', read: false }),
        findMany: jest.fn(),
        count: jest.fn().mockResolvedValue(2),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    audit = { log: jest.fn().mockResolvedValue({}), logWithClient: jest.fn() };
    service = new NotificationsService(prisma as PrismaService, audit);
  });

  it('audits dispatch with the authenticated actor and target-user tenant scope', async () => {
    const dto: any = {
      userId: 'target-user',
      title: 'Maintenance due',
      type: 'MAINTENANCE',
      link: '/maintenance/orders/1',
      companyId: 'spoofed-company',
      branchId: 'spoofed-branch',
    };

    await service.dispatch(dto, 'actor-user');

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'target-user' },
      select: { companyId: true, branchId: true },
    });
    expect(audit.log).toHaveBeenCalledWith('actor-user', 'DISPATCH', 'Notification', 'notification-1',
      expect.objectContaining({
        schemaVersion: 1,
        companyId: 'company-a',
        branchId: 'branch-a',
        scope: 'USER_NOTIFICATIONS',
        actor: { userId: 'actor-user' },
        targetUserId: 'target-user',
        previous: null,
        next: expect.objectContaining({
          id: 'notification-1',
          targetUserId: 'target-user',
          title: 'Maintenance due',
          type: 'MAINTENANCE',
          read: false,
        }),
        reason: 'NOTIFICATION_DISPATCHED',
      }));
  });

  it('audits mark-read with previous and next values', async () => {
    await service.markRead('notification-1', 'target-user', 'actor-user');

    expect(audit.log).toHaveBeenCalledWith('actor-user', 'MARK_READ', 'Notification', 'notification-1',
      expect.objectContaining({
        companyId: 'company-a',
        branchId: 'branch-a',
        actor: { userId: 'actor-user' },
        targetUserId: 'target-user',
        previous: { read: false },
        next: { read: true, affected: 1 },
        reason: 'NOTIFICATION_MARK_READ',
      }));
  });

  it('audits mark-all-read with the unread counts', async () => {
    await service.markAllRead('target-user', 'actor-user');

    expect(audit.log).toHaveBeenCalledWith('actor-user', 'MARK_ALL_READ', 'Notification', undefined,
      expect.objectContaining({
        previous: { unreadCount: 2 },
        next: { unreadCount: 0, affected: 1 },
        reason: 'NOTIFICATION_MARK_ALL_READ',
      }));
  });

  it('audits deletion with the removed notification details', async () => {
    await service.delete('notification-1', 'target-user', 'actor-user');

    expect(audit.log).toHaveBeenCalledWith('actor-user', 'DELETE', 'Notification', 'notification-1',
      expect.objectContaining({
        previous: { title: 'Maintenance due', type: 'MAINTENANCE', read: false },
        next: { deleted: true, affected: 1 },
        reason: 'NOTIFICATION_DELETED',
      }));
  });

  it('never emits an actorless audit row', async () => {
    await service.markRead('notification-1', 'target-user');

    expect(audit.log).not.toHaveBeenCalled();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.notification.updateMany).toHaveBeenCalled();
  });
});
