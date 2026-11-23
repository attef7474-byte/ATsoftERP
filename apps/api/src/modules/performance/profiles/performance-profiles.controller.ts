import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../modules/auth/guards/permissions.guard';
import { Permissions } from '../../../modules/auth/decorators/permissions.decorator';
import { CurrentActiveContext } from '../../../common/operational-context/current-active-context.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import { PerformanceProfilesService } from './performance-profiles.service';
import { CreatePerformanceProfileDto } from '../dto/create-performance-profile.dto';
import { UpdatePerformanceProfileDto } from '../dto/update-performance-profile.dto';

@ApiTags('performance-profiles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'performance/profiles', version: '1' })
export class PerformanceProfilesController {
  constructor(private service: PerformanceProfilesService) {}

  @Post()
  @Permissions('performance-profile:create')
  @ApiOperation({ summary: 'Create a performance profile' })
  create(@Body() dto: CreatePerformanceProfileDto, @CurrentActiveContext() ctx: ActiveOperationalContext, @CurrentUser('id') userId: string) {
    return this.service.create(dto, ctx, userId);
  }

  @Get()
  @Permissions('performance-profile:read')
  @ApiOperation({ summary: 'List performance profiles' })
  findAll(@Query() query: { page?: string; limit?: string; search?: string; category?: string; isActive?: string }, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findAll({
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      search: query.search,
      category: query.category,
      isActive: query.isActive,
    }, ctx);
  }

  @Get(':id')
  @Permissions('performance-profile:read')
  @ApiOperation({ summary: 'Get a performance profile' })
  findOne(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findOne(id, ctx);
  }

  @Patch(':id')
  @Permissions('performance-profile:update')
  @ApiOperation({ summary: 'Update a performance profile' })
  update(@Param('id') id: string, @Body() dto: UpdatePerformanceProfileDto, @CurrentActiveContext() ctx: ActiveOperationalContext, @CurrentUser('id') userId: string) {
    return this.service.update(id, dto, ctx, userId);
  }

  @Post(':id/deactivate')
  @Permissions('performance-profile:deactivate')
  @ApiOperation({ summary: 'Deactivate a performance profile' })
  deactivate(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext, @CurrentUser('id') userId: string) {
    return this.service.deactivate(id, ctx, userId);
  }

  @Post(':id/activate')
  @Permissions('performance-profile:update')
  @ApiOperation({ summary: 'Activate a performance profile' })
  activate(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext, @CurrentUser('id') userId: string) {
    return this.service.activate(id, ctx, userId);
  }
}
