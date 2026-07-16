import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { DispatchNotificationDto } from './dto/dispatch-notification.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'notifications', version: '1' })
export class NotificationsController {
  constructor(private service: NotificationsService) {}

  @Post('dispatch')
  @Permissions('notifications:dispatch')
  @ApiOperation({ summary: 'Dispatch a notification' })
  dispatch(@Body() dto: DispatchNotificationDto) { return this.service.dispatch(dto); }

  @Get('inbox')
  @Permissions('notifications:read')
  @ApiOperation({ summary: 'Get user notification inbox' })
  inbox(@Req() req: any, @Query() query: { page?: string; limit?: string; type?: string; read?: string }) {
    return this.service.findInbox(req.user?.id, {
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      type: query.type,
      read: query.read,
    });
  }

  @Get('unread-count')
  @Permissions('notifications:read')
  @ApiOperation({ summary: 'Get unread notification count' })
  unreadCount(@Req() req: any) { return this.service.countUnread(req.user?.id); }

  @Patch(':id/read')
  @Permissions('notifications:mark-read')
  @ApiOperation({ summary: 'Mark notification as read' })
  markRead(@Param('id') id: string, @Req() req: any) { return this.service.markRead(id, req.user?.id); }

  @Post('mark-all-read')
  @Permissions('notifications:mark-read')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  markAllRead(@Req() req: any) { return this.service.markAllRead(req.user?.id); }

  @Delete(':id')
  @Permissions('notifications:delete')
  @ApiOperation({ summary: 'Delete a notification' })
  delete(@Param('id') id: string, @Req() req: any) { return this.service.delete(id, req.user?.id); }
}
