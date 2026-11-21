import { Injectable, NotFoundException, ForbiddenException, Optional } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { AddParticipantsDto } from './dto/add-participants.dto';

const AUDIT_SCOPE = 'INTERNAL_MESSAGING';

@Injectable()
export class MessagingService {
  constructor(private prisma: PrismaService, @Optional() private readonly audit?: AuditService) {}

  private auditWriter(): AuditService {
    return this.audit ?? new AuditService(this.prisma);
  }

  /**
   * Internal conversations have no tenant columns. Scope is derived from the
   * authoritative actor user record, never from a DTO or request header.
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
    entity: string,
    entityId: string | undefined,
    details: Record<string, unknown>,
    reason: string,
  ) {
    if (!userId) return; // never emit actorless audit rows
    const scope = await this.scopeForUser(userId);
    await this.auditWriter().log(userId, action, entity, entityId, {
      schemaVersion: 1,
      companyId: scope.companyId,
      branchId: scope.branchId,
      scope: AUDIT_SCOPE,
      actor: { userId },
      previous: details.previous ?? null,
      next: details.next ?? null,
      ...details,
      reason,
    });
  }

  async createConversation(dto: CreateConversationDto, userId: string) {
    const participantIds = [...new Set([...dto.participantUserIds, userId])];

    const conversation = await this.prisma.internalConversation.create({
      data: {
        title: dto.title,
        createdByUserId: userId,
        participants: {
          create: participantIds.map((id) => ({ userId: id })),
        },
      },
      include: {
        participants: { include: { user: { select: { id: true, name: true, email: true, avatar: true } } } },
      },
    });

    await this.auditWrite(userId, 'CREATE', 'InternalConversation', conversation.id, {
      previous: null,
      next: { title: conversation.title ?? null, participantIds },
    }, 'CONVERSATION_CREATED');

    return conversation;
  }

  async findConversations(userId: string, query: { page?: number; limit?: number; search?: string }) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {
      participants: { some: { userId } },
      deletedAt: null,
    };

    if (query.search) {
      where.OR = [
        { title: { contains: query.search } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.internalConversation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { lastMessageAt: 'desc' },
        include: {
          participants: {
            include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
          },
          messages: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            select: { id: true, body: true, createdAt: true, senderUserId: true, isSystem: true },
          },
        },
      }),
      this.prisma.internalConversation.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findConversationById(id: string, userId: string) {
    const conversation = await this.prisma.internalConversation.findFirst({
      where: { id, participants: { some: { userId } }, deletedAt: null },
      include: {
        participants: {
          include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
        },
      },
    });

    if (!conversation) throw new NotFoundException('Conversation not found');
    return conversation;
  }

  async findMessages(conversationId: string, userId: string, query: { page?: number; limit?: number }) {
    const page = query.page || 1;
    const limit = query.limit || 50;
    const skip = (page - 1) * limit;

    const conversation = await this.prisma.internalConversation.findFirst({
      where: { id: conversationId, participants: { some: { userId } }, deletedAt: null },
    });

    if (!conversation) throw new NotFoundException('Conversation not found');

    const [data, total] = await Promise.all([
      this.prisma.internalMessage.findMany({
        where: { conversationId, deletedAt: null },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          sender: { select: { id: true, name: true, email: true, avatar: true } },
        },
      }),
      this.prisma.internalMessage.count({ where: { conversationId, deletedAt: null } }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async sendMessage(dto: SendMessageDto, userId: string) {
    const conversation = await this.prisma.internalConversation.findFirst({
      where: { id: dto.conversationId, participants: { some: { userId } }, deletedAt: null },
    });

    if (!conversation) throw new NotFoundException('Conversation not found');

    const message = await this.prisma.internalMessage.create({
      data: {
        conversationId: dto.conversationId,
        senderUserId: userId,
        body: dto.body,
        isSystem: dto.isSystem || false,
      },
      include: {
        sender: { select: { id: true, name: true, email: true, avatar: true } },
      },
    });

    await this.prisma.internalConversation.update({
      where: { id: dto.conversationId },
      data: { lastMessageAt: new Date() },
    });

    await this.auditWrite(userId, 'SEND', 'InternalMessage', message.id, {
      previous: { lastMessageAt: conversation.lastMessageAt?.toISOString?.() ?? null },
      next: {
        conversationId: dto.conversationId,
        isSystem: message.isSystem,
        bodyLength: dto.body?.length ?? 0,
      },
    }, 'MESSAGE_SENT');

    return message;
  }

  async addParticipants(conversationId: string, dto: AddParticipantsDto, userId: string) {
    const conversation = await this.prisma.internalConversation.findFirst({
      where: { id: conversationId, createdByUserId: userId, deletedAt: null },
    });

    if (!conversation) throw new ForbiddenException('Only the conversation creator can add participants');

    const existing = await this.prisma.internalConversationParticipant.findMany({
      where: { conversationId, userId: { in: dto.participantUserIds } },
      select: { userId: true },
    });

    const existingIds = new Set(existing.map((p) => p.userId));
    const newIds = dto.participantUserIds.filter((id) => !existingIds.has(id));

    if (newIds.length > 0) {
      await this.prisma.internalConversationParticipant.createMany({
        data: newIds.map((id) => ({ conversationId, userId: id })),
      });
    }

    await this.auditWrite(userId, 'ADD_PARTICIPANTS', 'InternalConversation', conversationId, {
      previous: { alreadyMembers: [...existingIds] },
      next: { addedUserIds: newIds },
    }, 'PARTICIPANTS_ADDED');

    return this.findConversationById(conversationId, userId);
  }

  async removeParticipant(conversationId: string, participantUserId: string, userId: string) {
    const conversation = await this.prisma.internalConversation.findFirst({
      where: { id: conversationId, createdByUserId: userId, deletedAt: null },
    });

    if (!conversation) throw new ForbiddenException('Only the conversation creator can remove participants');

    if (participantUserId === userId) {
      throw new ForbiddenException('Cannot remove yourself as the creator');
    }

    await this.prisma.internalConversationParticipant.deleteMany({
      where: { conversationId, userId: participantUserId },
    });

    await this.auditWrite(userId, 'REMOVE_PARTICIPANT', 'InternalConversation', conversationId, {
      previous: { participantUserId },
      next: { participantUserId, removed: true },
    }, 'PARTICIPANT_REMOVED');
  }

  async markConversationRead(conversationId: string, userId: string) {
    const lastReadAt = new Date();
    await this.prisma.internalConversationParticipant.updateMany({
      where: { conversationId, userId },
      data: { lastReadAt },
    });

    await this.auditWrite(userId, 'MARK_READ', 'InternalConversation', conversationId, {
      previous: null,
      next: { lastReadAt: lastReadAt.toISOString() },
    }, 'CONVERSATION_MARK_READ');
  }

  async getUnreadCount(userId: string) {
    const result = await this.prisma.internalConversationParticipant.findMany({
      where: { userId },
      select: {
        conversationId: true,
        lastReadAt: true,
        conversation: {
          select: {
            lastMessageAt: true,
            messages: {
              take: 1,
              orderBy: { createdAt: 'desc' },
              select: { createdAt: true },
            },
          },
        },
      },
    });

    let unread = 0;
    for (const p of result) {
      if (!p.lastReadAt && p.conversation.lastMessageAt) {
        unread++;
      } else if (p.lastReadAt && p.conversation.lastMessageAt && p.conversation.lastMessageAt > p.lastReadAt) {
        unread++;
      }
    }

    return { count: unread };
  }
}
