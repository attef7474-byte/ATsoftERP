import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProductionAnalyticsService } from './production-analytics.service';
import { ANALYTICS_PERMISSION_KEYS } from './production-analytics.constants';
import { AnalyticsExportQueryDto, AnalyticsPageDto, AnalyticsQueryDto } from './dto/analytics-query.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { CurrentActiveContext } from '../../../common/operational-context/current-active-context.decorator';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';

@ApiTags('Production Analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'reports/production', version: '1' })
export class ProductionAnalyticsController {
  constructor(private readonly service: ProductionAnalyticsService) {}

  @Get('oee')
  @Permissions(ANALYTICS_PERMISSION_KEYS.analyticsRead)
  @ApiOperation({ summary: 'OEE report over a window with per-run factors and target comparison' })
  oee(@Query() query: AnalyticsQueryDto, @CurrentActiveContext() ctx: ActiveOperationalContext): Promise<any> {
    return this.service.oee(query, ctx);
  }

  @Get('trends')
  @Permissions(ANALYTICS_PERMISSION_KEYS.analyticsRead)
  @ApiOperation({ summary: 'OEE trend bucketed by day, week, or month' })
  trends(@Query() query: AnalyticsQueryDto, @CurrentActiveContext() ctx: ActiveOperationalContext): Promise<any> {
    return this.service.trends(query, ctx);
  }

  @Get('loss-pareto')
  @Permissions(ANALYTICS_PERMISSION_KEYS.analyticsRead)
  @ApiOperation({ summary: 'Downtime loss Pareto grouped by loss reason' })
  lossPareto(@Query() query: AnalyticsQueryDto, @CurrentActiveContext() ctx: ActiveOperationalContext): Promise<any> {
    return this.service.lossPareto(query, ctx);
  }

  @Get('bottlenecks')
  @Permissions(ANALYTICS_PERMISSION_KEYS.analyticsRead)
  @ApiOperation({ summary: 'Unplanned downtime by machine/line to find bottlenecks' })
  bottlenecks(@Query() query: AnalyticsQueryDto, @CurrentActiveContext() ctx: ActiveOperationalContext): Promise<any> {
    return this.service.bottlenecks(query, ctx);
  }

  @Get('capacity-variance')
  @Permissions(ANALYTICS_PERMISSION_KEYS.analyticsRead)
  @ApiOperation({ summary: 'Planned vs ideal vs actual output per run' })
  capacityVariance(@Query() query: AnalyticsQueryDto, @CurrentActiveContext() ctx: ActiveOperationalContext): Promise<any> {
    return this.service.capacityVariance(query, ctx);
  }

  @Get('drilldown')
  @Permissions(ANALYTICS_PERMISSION_KEYS.analyticsRead)
  @ApiOperation({ summary: 'Paged per-run OEE drilldown' })
  drilldown(@Query() query: AnalyticsPageDto, @CurrentActiveContext() ctx: ActiveOperationalContext): Promise<any> {
    return this.service.drilldown(query, ctx);
  }

  @Get('output')
  @Permissions(ANALYTICS_PERMISSION_KEYS.analyticsRead)
  @ApiOperation({ summary: 'Output summary by product, line, and machine' })
  output(@Query() query: AnalyticsQueryDto, @CurrentActiveContext() ctx: ActiveOperationalContext): Promise<any> {
    return this.service.output(query, ctx);
  }

  @Get('downtime')
  @Permissions(ANALYTICS_PERMISSION_KEYS.analyticsRead)
  @ApiOperation({ summary: 'Downtime summary by reason and shift' })
  downtime(@Query() query: AnalyticsQueryDto, @CurrentActiveContext() ctx: ActiveOperationalContext): Promise<any> {
    return this.service.downtime(query, ctx);
  }

  @Get('losses')
  @Permissions(ANALYTICS_PERMISSION_KEYS.analyticsRead)
  @ApiOperation({ summary: 'Loss quantity events by type and reason' })
  losses(@Query() query: AnalyticsQueryDto, @CurrentActiveContext() ctx: ActiveOperationalContext): Promise<any> {
    return this.service.losses(query, ctx);
  }

  @Get('quality')
  @Permissions(ANALYTICS_PERMISSION_KEYS.analyticsRead)
  @ApiOperation({ summary: 'Quality factor and inspection/disposition summary' })
  quality(@Query() query: AnalyticsQueryDto, @CurrentActiveContext() ctx: ActiveOperationalContext): Promise<any> {
    return this.service.quality(query, ctx);
  }

  @Get('materials')
  @Permissions(ANALYTICS_PERMISSION_KEYS.analyticsRead)
  @ApiOperation({ summary: 'Material consumption summary by product' })
  materials(@Query() query: AnalyticsQueryDto, @CurrentActiveContext() ctx: ActiveOperationalContext): Promise<any> {
    return this.service.materials(query, ctx);
  }

  @Get('cost')
  @Permissions(ANALYTICS_PERMISSION_KEYS.analyticsRead)
  @ApiOperation({ summary: 'Operational cost summary by event type and cost center' })
  cost(@Query() query: AnalyticsQueryDto, @CurrentActiveContext() ctx: ActiveOperationalContext): Promise<any> {
    return this.service.cost(query, ctx);
  }

  @Post('export')
  @Permissions(ANALYTICS_PERMISSION_KEYS.analyticsExport)
  @ApiOperation({ summary: 'Export a production analytics report as CSV (audited)' })
  export(@Body() dto: AnalyticsExportQueryDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext): Promise<any> {
    return this.service.export(dto, userId, ctx);
  }
}
