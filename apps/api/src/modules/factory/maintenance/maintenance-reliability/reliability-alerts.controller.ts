import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ReliabilityAlertsService } from './reliability-alerts.service';
import {
  AlertByIdQueryDto,
  CreateAlertMaintenanceRequestDto,
  PlanningCandidateQueryDto,
  QueryReliabilityAlertsDto,
} from './dto/reliability-alert.dto';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { CurrentUserType } from '../../../../modules/auth/types/current-user.type';
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

  @Get('detail')
  @Permissions('maintenance-reliability:read')
  @ApiOperation({ summary: 'Full evidence, action and read-only stock context for one derived alert' })
  detail(@Query() query: AlertByIdQueryDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getAlertDetail(query, ctx);
  }

  @Get('action-status')
  @Permissions('maintenance-reliability:read')
  @ApiOperation({ summary: 'Derived action status for one alert from linked canonical documents' })
  actionStatus(@Query() query: AlertByIdQueryDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getActionStatus(query, ctx);
  }

  @Post('maintenance-request')
  @Permissions('maintenance-request:create')
  @ApiOperation({ summary: 'Create a canonical maintenance request from a reliability alert (deduplicated)' })
  createRequest(
    @Body() dto: CreateAlertMaintenanceRequestDto,
    @CurrentUser() user: CurrentUserType,
    @CurrentActiveContext() ctx: ActiveOperationalContext,
  ) {
    return this.service.createMaintenanceRequestFromAlert(dto, user, ctx);
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
