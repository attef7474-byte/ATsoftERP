import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SystemSettingsService } from './system-settings.service';
import { CreateSystemSettingDto } from '../dto/create-system-setting.dto';
import { UpdateSystemSettingDto } from '../dto/update-system-setting.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';

@ApiTags('System Settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'settings', version: '1' })
export class SystemSettingsController {
  constructor(private service: SystemSettingsService) {}

  @Post()
  @Permissions('settings:create')
  @ApiOperation({ summary: 'Create system setting' })
  create(@Body() dto: CreateSystemSettingDto) { return this.service.create(dto); }

  @Get()
  @Permissions('settings:read')
  @ApiOperation({ summary: 'List system settings' })
  findAll(@Query() query: { page?: string; limit?: string; search?: string; group?: string }) {
    return this.service.findAll({
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      search: query.search,
      group: query.group,
    });
  }

  @Get('groups/:group')
  @Permissions('settings:read')
  @ApiOperation({ summary: 'Get settings by group' })
  findByGroup(@Param('group') group: string) { return this.service.findByGroup(group); }

  @Get(':id')
  @Permissions('settings:read')
  @ApiOperation({ summary: 'Get system setting by ID' })
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Patch(':id')
  @Permissions('settings:update')
  @ApiOperation({ summary: 'Update system setting' })
  update(@Param('id') id: string, @Body() dto: UpdateSystemSettingDto) { return this.service.update(id, dto); }
}
