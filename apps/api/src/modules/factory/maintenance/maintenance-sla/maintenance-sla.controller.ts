import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../../common/guards/permissions.guard';
import { Permissions } from '../../../../modules/auth/decorators/permissions.decorator';
import { MaintenanceSlaService } from './maintenance-sla.service';
import { CurrentActiveContext } from '../../../../common/operational-context/current-active-context.decorator';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';

@ApiTags('Maintenance SLA')
@Controller('maintenance/sla')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class MaintenanceSlaController {
  constructor(private readonly maintenanceSlaService: MaintenanceSlaService) {}

  @Post(':requestId/calculate')
  @Permissions('maintenance-request:update')
  @ApiOperation({ summary: 'Calculate SLA deadlines for a request' })
  async calculate(@Param('requestId') requestId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    await this.maintenanceSlaService.createSlaState(requestId, ctx);
    return { message: 'SLA calculated' };
  }

  @Post(':requestId/recalculate')
  @Permissions('maintenance-request:update')
  @ApiOperation({ summary: 'Recalculate SLA status and escalation' })
  async recalculate(@Param('requestId') requestId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.maintenanceSlaService.recalculateSla(requestId, ctx);
  }

  @Get(':requestId')
  @Permissions('maintenance-request:read')
  @ApiOperation({ summary: 'Get SLA summary for a request' })
  async getSummary(@Param('requestId') requestId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.maintenanceSlaService.getSlaSummary(requestId, ctx);
  }

  @Get('stats/overview')
  @Permissions('maintenance-request:read')
  @ApiOperation({ summary: 'Get SLA statistics' })
  async getStats(@CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.maintenanceSlaService.getSlaStats(ctx);
  }

  @Get('overdue/list')
  @Permissions('maintenance-request:read')
  @ApiOperation({ summary: 'List overdue requests' })
  async getOverdue(@CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.maintenanceSlaService.getOverdueRequests(ctx);
  }
}
