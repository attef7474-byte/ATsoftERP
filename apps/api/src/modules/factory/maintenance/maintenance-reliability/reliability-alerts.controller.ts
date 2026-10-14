import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ReliabilityAlertsService } from './reliability-alerts.service';
import { QueryReliabilityAlertsDto, PlanningCandidateQueryDto } from './dto/reliability-alert.dto';
import { CurrentActiveContext } from '../../../../common/operational-context/current-active-context.decorator';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';
import { JwtAuthGuard } from '../../../../modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../../modules/auth/guards/permissions.guard';
import { Permissions } from '../../../../modules/auth/decorators/permissions.decorator';

@ApiTags('Reliability Alerts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'maintenance/reliability/alerts', version: '1' })
export class ReliabilityAlertsController {
  constructor(private service: ReliabilityAlertsService) {}

  @Get()
  @Permissions('maintenance-reliability:read')
  @ApiOperation({ summary: 'List derived reliability alerts and preventive-planning signals' })
  list(@Query() query: QueryReliabilityAlertsDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.listAlerts(query, ctx);
  }

  @Get('summary')
  @Permissions('maintenance-reliability:read')
  @ApiOperation({ summary: 'Reliability alert summary counts and eligibility' })
  summary(@Query() query: QueryReliabilityAlertsDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getSummary(query, ctx);
  }

  @Get('data-quality')
  @Permissions('maintenance-reliability:read')
  @ApiOperation({ summary: 'Reliability alert data-quality / eligibility report' })
  dataQuality(@Query() query: QueryReliabilityAlertsDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getDataQuality(query, ctx);
  }

  @Get('planning-candidate')
  @Permissions('maintenance-reliability:read')
  @ApiOperation({ summary: 'Preventive-planning candidate (prefill) for a reliability alert' })
  planningCandidate(@Query() query: PlanningCandidateQueryDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getPlanningCandidate(query, ctx);
  }
}
