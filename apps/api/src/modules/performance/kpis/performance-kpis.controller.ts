import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { CurrentActiveContext } from '../../../common/operational-context/current-active-context.decorator';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { PerformanceKpisService } from './performance-kpis.service';
import { CreatePerformanceKpiDto } from '../dto/create-performance-kpi.dto';
import { UpdatePerformanceKpiDto } from '../dto/update-performance-kpi.dto';

@ApiTags('performance-kpis')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'performance/kpis', version: '1' })
export class PerformanceKpisController {
  constructor(private readonly service: PerformanceKpisService) {}

  @Post()
  @Permissions('performance-kpi:create')
  @ApiOperation({ summary: 'Create KPI definition' })
  create(@Body() dto: CreatePerformanceKpiDto, @CurrentActiveContext() ctx: ActiveOperationalContext, @CurrentUser() user: any) {
    return this.service.create(dto, ctx, user?.id);
  }

  @Get()
  @Permissions('performance-kpi:read')
  @ApiOperation({ summary: 'List KPI definitions' })
  findAll(@Query() query: any, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findAll(query, ctx);
  }

  @Get(':id')
  @Permissions('performance-kpi:read')
  @ApiOperation({ summary: 'Get KPI definition' })
  findOne(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findOne(id, ctx);
  }

  @Patch(':id')
  @Permissions('performance-kpi:update')
  @ApiOperation({ summary: 'Update KPI definition' })
  update(@Param('id') id: string, @Body() dto: UpdatePerformanceKpiDto, @CurrentActiveContext() ctx: ActiveOperationalContext, @CurrentUser() user: any) {
    return this.service.update(id, dto, ctx, user?.id);
  }

  @Post(':id/deactivate')
  @Permissions('performance-kpi:deactivate')
  @ApiOperation({ summary: 'Deactivate KPI definition' })
  deactivate(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext, @CurrentUser() user: any) {
    return this.service.deactivate(id, ctx, user?.id);
  }

  @Post(':id/activate')
  @Permissions('performance-kpi:update')
  @ApiOperation({ summary: 'Activate KPI definition' })
  activate(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext, @CurrentUser() user: any) {
    return this.service.activate(id, ctx, user?.id);
  }
}
