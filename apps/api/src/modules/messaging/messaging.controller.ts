import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { MessagingService } from './messaging.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { AddParticipantsDto } from './dto/add-participants.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';

@ApiTags('Messaging')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'messaging', version: '1' })
export class MessagingController {
  constructor(private service: MessagingService) {}

  @Post('conversations')
  @Permissions('messaging:create')
  @ApiOperation({ summary: 'Create a conversation' })
  createConversation(@Body() dto: CreateConversationDto, @Req() req: any) {
    return this.service.createConversation(dto, req.user?.id);
  }

  @Get('conversations')
  @Permissions('messaging:read')
  @ApiOperation({ summary: 'List user conversations' })
  findConversations(@Req() req: any, @Query() query: { page?: string; limit?: string; search?: string }) {
    return this.service.findConversations(req.user?.id, {
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      search: query.search,
    });
  }

  @Get('conversations/:id')
  @Permissions('messaging:read')
  @ApiOperation({ summary: 'Get conversation by ID' })
  findConversation(@Param('id') id: string, @Req() req: any) {
    return this.service.findConversationById(id, req.user?.id);
  }

  @Get('conversations/:id/messages')
  @Permissions('messaging:read')
  @ApiOperation({ summary: 'Get messages in a conversation' })
  findMessages(@Param('id') id: string, @Req() req: any, @Query() query: { page?: string; limit?: string }) {
    return this.service.findMessages(id, req.user?.id, {
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
    });
  }

  @Post('messages')
  @Permissions('messaging:send')
  @ApiOperation({ summary: 'Send a message' })
  sendMessage(@Body() dto: SendMessageDto, @Req() req: any) {
    return this.service.sendMessage(dto, req.user?.id);
  }

  @Post('conversations/:id/participants')
  @Permissions('messaging:manage')
  @ApiOperation({ summary: 'Add participants to conversation' })
  addParticipants(@Param('id') id: string, @Body() dto: AddParticipantsDto, @Req() req: any) {
    return this.service.addParticipants(id, dto, req.user?.id);
  }

  @Delete('conversations/:id/participants/:userId')
  @Permissions('messaging:manage')
  @ApiOperation({ summary: 'Remove participant from conversation' })
  removeParticipant(@Param('id') id: string, @Param('userId') participantUserId: string, @Req() req: any) {
    return this.service.removeParticipant(id, participantUserId, req.user?.id);
  }

  @Post('conversations/:id/read')
  @Permissions('messaging:read')
  @ApiOperation({ summary: 'Mark conversation as read' })
  markRead(@Param('id') id: string, @Req() req: any) {
    return this.service.markConversationRead(id, req.user?.id);
  }

  @Get('unread-count')
  @Permissions('messaging:read')
  @ApiOperation({ summary: 'Get unread conversation count' })
  unreadCount(@Req() req: any) {
    return this.service.getUnreadCount(req.user?.id);
  }
}
