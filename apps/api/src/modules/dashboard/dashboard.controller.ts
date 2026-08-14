import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentActiveContext } from '../../common/operational-context/current-active-context.decorator';
import { ActiveOperationalContext } from '../../common/operational-context/operational-context.types';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get('summary')
  @Permissions('dashboard.view')
  @ApiOperation({ summary: 'Get dashboard summary counts' })
  async getSummary(
    @CurrentActiveContext() ctx: ActiveOperationalContext,
    @CurrentUser('id') userId: string,
  ) {
    return this.service.getSummary(ctx, userId);
  }

  @Get('operations')
  @Permissions('dashboard.operations.view')
  @ApiOperation({ summary: 'Get operations dashboard data' })
  async getOperations(
    @CurrentActiveContext() ctx: ActiveOperationalContext,
  ) {
    return this.service.getOperations(ctx);
  }

  @Get('kpis')
  @Permissions('dashboard.view')
  @ApiOperation({ summary: 'Get KPI data' })
  async getKpis(@CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getKpis(ctx);
  }
}
