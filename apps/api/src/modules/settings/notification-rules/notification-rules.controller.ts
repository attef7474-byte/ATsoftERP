import { Controller, Get, Post, Patch, Delete, Param, Body, Query } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger'
import { NotificationRulesService } from './notification-rules.service'
import { Permissions } from '../../../common/decorators/permissions.decorator'

@ApiTags('Settings')
@Controller('notifications/rules')
export class NotificationRulesController {
  constructor(private readonly service: NotificationRulesService) {}

  @Get()
  @Permissions('settings.notifications.view')
  @ApiOperation({ summary: 'List notification rules' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiQuery({ name: 'eventType', required: false })
  @ApiQuery({ name: 'enabled', required: false })
  async findAll(@Query('page') page?: string, @Query('pageSize') pageSize?: string, @Query('eventType') eventType?: string, @Query('enabled') enabled?: string) {
    return this.service.findAll(Number(page) || 1, Number(pageSize) || 20, eventType, enabled)
  }

  @Get(':id')
  @Permissions('settings.notifications.view')
  @ApiOperation({ summary: 'Get notification rule by ID' })
  async findOne(@Param('id') id: string) {
    return this.service.findOne(id)
  }

  @Post()
  @Permissions('settings.notifications.manage')
  @ApiOperation({ summary: 'Create notification rule' })
  async create(@Body() dto: any) {
    return this.service.create(dto)
  }

  @Patch(':id')
  @Permissions('settings.notifications.manage')
  @ApiOperation({ summary: 'Update notification rule' })
  async update(@Param('id') id: string, @Body() dto: any) {
    return this.service.update(id, dto)
  }

  @Delete(':id')
  @Permissions('settings.notifications.manage')
  @ApiOperation({ summary: 'Delete notification rule' })
  async remove(@Param('id') id: string) {
    return this.service.remove(id)
  }

  @Patch(':id/activate')
  @Permissions('settings.notifications.manage')
  @ApiOperation({ summary: 'Activate notification rule' })
  async activate(@Param('id') id: string) {
    return this.service.activate(id)
  }

  @Patch(':id/deactivate')
  @Permissions('settings.notifications.manage')
  @ApiOperation({ summary: 'Deactivate notification rule' })
  async deactivate(@Param('id') id: string) {
    return this.service.deactivate(id)
  }
}
