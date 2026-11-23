import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { CurrentActiveContext } from '../../../common/operational-context/current-active-context.decorator';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { PerformanceKpiEligibilityService } from './performance-kpi-eligibility.service';
import { CreatePerformanceProfileKpiEligibilityDto } from '../dto/create-performance-profile-kpi-eligibility.dto';
import { UpdatePerformanceProfileKpiEligibilityDto } from '../dto/update-performance-profile-kpi-eligibility.dto';

@ApiTags('performance-kpi-eligibility')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'performance/kpi-eligibility', version: '1' })
export class PerformanceKpiEligibilityController {
  constructor(private readonly service: PerformanceKpiEligibilityService) {}

  @Post() @Permissions('performance-profile-kpi-eligibility:create')
  @ApiOperation({ summary: 'Create KPI eligibility' })
  create(@Body() dto: CreatePerformanceProfileKpiEligibilityDto, @CurrentActiveContext() ctx: ActiveOperationalContext, @CurrentUser() user: any) { return this.service.create(dto, ctx, user?.id); }

  @Get() @Permissions('performance-profile-kpi-eligibility:read')
  @ApiOperation({ summary: 'List KPI eligibilities' })
  findAll(@Query() query: any, @CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.findAll(query, ctx); }

  @Get(':id') @Permissions('performance-profile-kpi-eligibility:read')
  @ApiOperation({ summary: 'Get KPI eligibility' })
  findOne(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.findOne(id, ctx); }

  @Patch(':id') @Permissions('performance-profile-kpi-eligibility:update')
  @ApiOperation({ summary: 'Update KPI eligibility' })
  update(@Param('id') id: string, @Body() dto: UpdatePerformanceProfileKpiEligibilityDto, @CurrentActiveContext() ctx: ActiveOperationalContext, @CurrentUser() user: any) { return this.service.update(id, dto, ctx, user?.id); }

  @Post(':id/deactivate') @Permissions('performance-profile-kpi-eligibility:deactivate')
  @ApiOperation({ summary: 'Deactivate KPI eligibility' })
  deactivate(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext, @CurrentUser() user: any) { return this.service.deactivate(id, ctx, user?.id); }

  @Post(':id/activate') @Permissions('performance-profile-kpi-eligibility:update')
  @ApiOperation({ summary: 'Activate KPI eligibility' })
  activate(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext, @CurrentUser() user: any) { return this.service.activate(id, ctx, user?.id); }
}
