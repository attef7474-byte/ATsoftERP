import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { CurrentActiveContext } from '../../../common/operational-context/current-active-context.decorator';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import { PerformanceKpiCoverageService } from './performance-kpi-coverage.service';

@ApiTags('performance-kpi-coverage')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'performance/kpis/coverage', version: '1' })
export class PerformanceKpiCoverageController {
  constructor(private readonly service: PerformanceKpiCoverageService) {}

  @Get()
  @Permissions('performance-kpi-coverage:read')
  @ApiOperation({ summary: 'KPI calculability coverage over active employees' })
  coverage(@Query() query: any, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.coverage(query, ctx);
  }
}
