import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { AddParticipantsDto } from './dto/add-participants.dto';

@Injectable()
export class MessagingService {
  constructor(private prisma: PrismaService) {}

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
  }

  async markConversationRead(conversationId: string, userId: string) {
    await this.prisma.internalConversationParticipant.updateMany({
      where: { conversationId, userId },
      data: { lastReadAt: new Date() },
    });
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
