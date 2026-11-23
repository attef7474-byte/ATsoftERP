import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../modules/auth/guards/permissions.guard';
import { Permissions } from '../../../modules/auth/decorators/permissions.decorator';
import { CurrentActiveContext } from '../../../common/operational-context/current-active-context.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import { PerformanceProfileMappingsService } from './performance-profile-mappings.service';
import { CreatePerformanceProfileMappingDto } from '../dto/create-performance-profile-mapping.dto';
import { UpdatePerformanceProfileMappingDto } from '../dto/update-performance-profile-mapping.dto';

@ApiTags('performance-profile-mappings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'performance/profile-mappings', version: '1' })
export class PerformanceProfileMappingsController {
  constructor(private service: PerformanceProfileMappingsService) {}

  @Post()
  @Permissions('performance-profile-mapping:create')
  create(@Body() dto: CreatePerformanceProfileMappingDto, @CurrentActiveContext() ctx: ActiveOperationalContext, @CurrentUser('id') userId: string) {
    return this.service.create(dto, ctx, userId);
  }

  @Get()
  @Permissions('performance-profile-mapping:read')
  findAll(@Query() query: any, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findAll({
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      performanceProfileId: query.performanceProfileId,
      targetType: query.targetType,
      jobTitleId: query.jobTitleId,
      isActive: query.isActive,
    }, ctx);
  }

  @Get(':id')
  @Permissions('performance-profile-mapping:read')
  findOne(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.findOne(id, ctx); }

  @Patch(':id')
  @Permissions('performance-profile-mapping:update')
  update(@Param('id') id: string, @Body() dto: UpdatePerformanceProfileMappingDto, @CurrentActiveContext() ctx: ActiveOperationalContext, @CurrentUser('id') userId: string) {
    return this.service.update(id, dto, ctx, userId);
  }

  @Post(':id/deactivate')
  @Permissions('performance-profile-mapping:deactivate')
  deactivate(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext, @CurrentUser('id') userId: string) {
    return this.service.deactivate(id, ctx, userId);
  }

  @Post(':id/activate')
  @Permissions('performance-profile-mapping:update')
  activate(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext, @CurrentUser('id') userId: string) {
    return this.service.activate(id, ctx, userId);
  }
}
