import { MessagingService } from './messaging.service';
import { PrismaService } from '../../common/prisma/prisma.service';

describe('MessagingService audit emission (Phase 6)', () => {
  let prisma: any;
  let audit: any;
  let service: MessagingService;

  beforeEach(() => {
    const conversation = {
      id: 'conversation-1',
      title: 'Maintenance coordination',
      createdByUserId: 'actor-user',
      lastMessageAt: null,
      participants: [],
    };
    prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ companyId: 'company-a', branchId: 'branch-a' }),
      },
      internalConversation: {
        create: jest.fn().mockResolvedValue(conversation),
        findFirst: jest.fn().mockResolvedValue(conversation),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(1),
        update: jest.fn().mockResolvedValue(conversation),
      },
      internalMessage: {
        create: jest.fn().mockResolvedValue({
          id: 'message-1',
          conversationId: 'conversation-1',
          senderUserId: 'actor-user',
          body: 'Please inspect line 2',
          isSystem: false,
        }),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      internalConversationParticipant: {
        findMany: jest.fn().mockResolvedValue([]),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    audit = { log: jest.fn().mockResolvedValue({}), logWithClient: jest.fn() };
    service = new MessagingService(prisma as PrismaService, audit);
  });

  it('audits conversation creation with actor and authoritative tenant scope', async () => {
    await service.createConversation({ title: 'Maintenance coordination', participantUserIds: ['target-user'] } as any, 'actor-user');

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'actor-user' },
      select: { companyId: true, branchId: true },
    });
    expect(audit.log).toHaveBeenCalledWith('actor-user', 'CREATE', 'InternalConversation', 'conversation-1',
      expect.objectContaining({
        schemaVersion: 1,
        companyId: 'company-a',
        branchId: 'branch-a',
        scope: 'INTERNAL_MESSAGING',
        actor: { userId: 'actor-user' },
        previous: null,
        next: expect.objectContaining({
          title: 'Maintenance coordination',
          participantIds: ['target-user', 'actor-user'],
        }),
        reason: 'CONVERSATION_CREATED',
      }));
  });

  it('audits message send with previous activity and message metadata', async () => {
    await service.sendMessage({ conversationId: 'conversation-1', body: 'Please inspect line 2' } as any, 'actor-user');

    expect(audit.log).toHaveBeenCalledWith('actor-user', 'SEND', 'InternalMessage', 'message-1',
      expect.objectContaining({
        scope: 'INTERNAL_MESSAGING',
        actor: { userId: 'actor-user' },
        previous: { lastMessageAt: null },
        next: expect.objectContaining({
          conversationId: 'conversation-1',
          isSystem: false,
          bodyLength: 21,
        }),
        reason: 'MESSAGE_SENT',
      }));
  });

  it('audits participant additions with already-member and added-user details', async () => {
    prisma.internalConversationParticipant.findMany.mockResolvedValue([{ userId: 'existing-user' }]);

    await service.addParticipants('conversation-1', {
      participantUserIds: ['existing-user', 'new-user'],
    } as any, 'actor-user');

    expect(audit.log).toHaveBeenCalledWith('actor-user', 'ADD_PARTICIPANTS', 'InternalConversation', 'conversation-1',
      expect.objectContaining({
        actor: { userId: 'actor-user' },
        previous: { alreadyMembers: ['existing-user'] },
        next: { addedUserIds: ['new-user'] },
        reason: 'PARTICIPANTS_ADDED',
      }));
  });

  it('audits participant removal', async () => {
    await service.removeParticipant('conversation-1', 'target-user', 'actor-user');

    expect(audit.log).toHaveBeenCalledWith('actor-user', 'REMOVE_PARTICIPANT', 'InternalConversation', 'conversation-1',
      expect.objectContaining({
        actor: { userId: 'actor-user' },
        previous: { participantUserId: 'target-user' },
        next: { participantUserId: 'target-user', removed: true },
        reason: 'PARTICIPANT_REMOVED',
      }));
  });

  it('audits marking a conversation read', async () => {
    await service.markConversationRead('conversation-1', 'actor-user');

    expect(audit.log).toHaveBeenCalledWith('actor-user', 'MARK_READ', 'InternalConversation', 'conversation-1',
      expect.objectContaining({
        actor: { userId: 'actor-user' },
        previous: null,
        next: expect.objectContaining({ lastReadAt: expect.any(String) }),
        reason: 'CONVERSATION_MARK_READ',
      }));
  });
});
